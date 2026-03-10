// client/src/app/app.component.ts
import { Component, OnInit, NgZone, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ApiService, LoreEntry, GenerationResponse } from './api.service';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  loreInput = '';
  recentLore: LoreEntry[] = [];

  scriptContent = '';
  generatedScene = '';
  contextUsed: string[] = [];

  isLoadingLore = false;
  isGenerating = false;
  showGenerationSpinner = false;

  logs: string[] = [];
  showToast = false;
  currentLogMessage = '';

  private destroy$ = new Subject<void>();
  private logTimeout: any;

  constructor(
    private apiService: ApiService,
    private ngZone: NgZone,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadRecentLore();
    this.setupLogListener();
  }

  loadRecentLore(): void {
    this.isLoadingLore = true;
    this.apiService
      .getRecentLore(10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lore) => {
          this.recentLore = lore;
          this.isLoadingLore = false;
        },
        error: (error) => {
          console.error('Error loading lore:', error);
          this.apiService.emitLog('✗ Failed to load lore');
          this.isLoadingLore = false;
        },
      });
  }

  saveLore(): void {
    if (!this.loreInput.trim()) {
      this.apiService.emitLog('⚠ Lore cannot be empty');
      return;
    }

    this.isLoadingLore = true;
    this.apiService
      .addLore(this.loreInput)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entry) => {
          this.recentLore.unshift(entry);
          if (this.recentLore.length > 10) {
            this.recentLore.pop();
          }
          this.loreInput = '';
          this.isLoadingLore = false;
        },
        error: (error) => {
          console.error('Error saving lore:', error);
          this.apiService.emitLog('✗ Failed to save lore');
          this.isLoadingLore = false;
        },
      });
  }

  generateScene(): void {
    console.log('generateScene() called; scriptContent=', this.scriptContent);
    if (!this.scriptContent.trim()) {
      this.apiService.emitLog('⚠ Please enter a scene prompt');
      return;
    }

    // wipe previous result while the new one is being created
    this.generatedScene = '';
    this.isGenerating = true;
    this.showGenerationSpinner = true;

    // ensure change detection occurs even if the HTTP callback leaves the zone
    const obs = this.apiService
      .generateWithContext(this.scriptContent)
      .pipe(takeUntil(this.destroy$));
    obs.subscribe({
      next: (response: GenerationResponse) => {
        console.log('subscription.next triggered');
        this.ngZone.run(() => {
          // response may sometimes come back as a plain string if parsing fails,
          // so guard accordingly and always update the UI state
          console.log('API response inside run:', response);

          const scene = (response && (response as any).scene) ?? '';
          // write the returned text to both helpers so it is obvious to the user
          this.generatedScene = scene;
          this.scriptContent = scene;

          // scroll preview into view so user can't miss it
          setTimeout(() => {
            const box = document.querySelector('.generated-box');
            if (box) {
              box.scrollIntoView({ behavior: 'smooth' });
            }
          });

          // log state for debugging
          console.log('scene assigned, generatedScene=', this.generatedScene);
          console.log('spinner before hide:', this.showGenerationSpinner);

          // record any lore that was used (array may include nulls)
          this.contextUsed = ((response && response.context_used) || []).filter(Boolean);

          this.isGenerating = false;
          this.showGenerationSpinner = false;
          console.log('spinner after hide:', this.showGenerationSpinner);
          // ensure template updates immediately
          this.cd.detectChanges();
        });
      },
      error: (error) => {
        console.log('subscription.error triggered');
        this.ngZone.run(() => {
          console.error('Error generating scene:', error);
          this.apiService.emitLog('✗ Generation failed');
          this.isGenerating = false;
          this.showGenerationSpinner = false;
        });
      },
      complete: () => {
        console.log('subscription.complete');
      },
    });
  }

  private setupLogListener(): void {
    this.apiService.logs$.pipe(takeUntil(this.destroy$)).subscribe((message) => {
      this.ngZone.run(() => {
        this.currentLogMessage = message;
        this.logs.push(message);
        this.showToast = true;

        if (this.logTimeout) {
          clearTimeout(this.logTimeout);
        }

        this.logTimeout = setTimeout(() => {
          this.showToast = false;
        }, 4000);
      });
    });
  }

  deleteLore(index: number): void {
    this.recentLore.splice(index, 1);
    this.apiService.emitLog('✓ Lore removed');
  }

  insertLoreIntoScript(fact: string): void {
    this.scriptContent += `\n[LORE: ${fact}]\n`;
    this.apiService.emitLog(`✓ Inserted lore into script`);
  }

  clearScript(): void {
    if (confirm('Clear the entire script? This cannot be undone.')) {
      this.scriptContent = '';
      this.generatedScene = '';
      this.apiService.emitLog('✓ Script cleared');
    }
  }

  exportScript(): void {
    const element = document.createElement('a');
    const file = new Blob([this.scriptContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `script-${Date.now()}.txt`;
    element.click();
    this.apiService.emitLog('✓ Script exported');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.logTimeout) {
      clearTimeout(this.logTimeout);
    }
  }
}
