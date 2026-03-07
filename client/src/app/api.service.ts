// client/src/app/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface LoreEntry {
  id: string;
  fact: string;
  timestamp: string;
}

export interface GenerationResponse {
  scene: string;
  context_used: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = 'http://localhost:8000';
  private logSubject = new Subject<string>();
  public logs$ = this.logSubject.asObservable();

  constructor(private http: HttpClient) {}

  /** Add a lore fact to the database */
  addLore(fact: string): Observable<LoreEntry> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const payload = { fact };

    return this.http.post<LoreEntry>(`${this.apiUrl}/lore`, payload, { headers }).pipe(
      tap(() => {
        this.logSubject.next(`✓ Lore saved: "${fact.substring(0, 50)}..."`);
      }),
    );
  }

  /** Fetch the most recent lore entries */
  getRecentLore(limit: number = 10): Observable<LoreEntry[]> {
    return this.http.get<LoreEntry[]>(`${this.apiUrl}/lore/recent?limit=${limit}`).pipe(
      tap(() => {
        this.logSubject.next(`✓ Retrieved recent lore entries`);
      }),
    );
  }

  /** Generate a scene using RAG context */
  generateWithContext(prompt: string): Observable<GenerationResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const payload = { prompt };

    // use the full RAG-enabled endpoint now that it returns context_used
    return this.http.post<GenerationResponse>(`${this.apiUrl}/generate`, payload, { headers }).pipe(
      tap((response) => {
        const contextCount = response.context_used?.length || 0;
        this.logSubject.next(`✓ RAG found ${contextCount} relevant lore entries`);
      }),
    );
  }

  /** Manual log push (used by the component) */
  emitLog(message: string): void {
    this.logSubject.next(message);
  }
}
