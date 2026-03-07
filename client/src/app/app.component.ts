// client/src/app/app.component.ts
import { Component, OnInit, NgZone, OnDestroy } from '@angular/core';
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
    if (!this.scriptContent.trim()) {
      this.apiService.emitLog('⚠ Please enter a scene prompt');
      return;
    }

    this.isGenerating = true;
    this.showGenerationSpinner = true;

    this.apiService
      .generateWithContext(this.scriptContent)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GenerationResponse) => {
          console.log('API response:', response);
          const scene = response.scene || '';
          // always push the raw generated scene into the textarea so users cannot miss it
          if (scene) {
            this.generatedScene = scene;
            this.scriptContent = scene; // replace existing content for clarity
          } else {
            console.warn('Empty scene returned from API');
          }

          // capture which lore snippets were used
          this.contextUsed = response.context_used || [];

          this.isGenerating = false;
          this.showGenerationSpinner = false;
        },

        error: (error) => {
          console.error('Error generating scene:', error);
          this.apiService.emitLog('✗ Generation failed');
          this.isGenerating = false;
          this.showGenerationSpinner = false;
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
