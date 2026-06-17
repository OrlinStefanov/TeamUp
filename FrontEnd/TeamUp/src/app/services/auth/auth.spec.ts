import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Auth } from './auth';
import { environment } from '../../../environments/environment';

function createToken(expSecondsFromNow: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'testuser',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'test@example.com',
  }));
  return `${header}.${payload}.signature`;
}

describe('Auth', () => {
  let service: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('refreshToken should save the new token', () => {
    const currentToken = createToken(3600);
    const refreshedToken = createToken(7200);
    localStorage.setItem('token', currentToken);

    service.refreshToken().subscribe(token => {
      expect(token).toBe(refreshedToken);
      expect(localStorage.getItem('token')).toBe(refreshedToken);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/refresh-token`);
    expect(req.request.method).toBe('POST');
    req.flush(refreshedToken);
  });

  it('refreshToken should share a single in-flight request', () => {
    const currentToken = createToken(3600);
    const refreshedToken = createToken(7200);
    localStorage.setItem('token', currentToken);

    const results: string[] = [];
    service.refreshToken().subscribe(token => results.push(token));
    service.refreshToken().subscribe(token => results.push(token));

    const req = httpMock.expectOne(`${environment.apiUrl}/refresh-token`);
    req.flush(refreshedToken);

    expect(results).toEqual([refreshedToken, refreshedToken]);
  });

  it('loadUserFromStorage should clear expired tokens locally', () => {
    localStorage.setItem('token', createToken(-60));

    service.loadUserFromStorage();

    expect(localStorage.getItem('token')).toBeNull();
    expect(service.getCurrentUser()).toBeNull();
    httpMock.expectNone(`${environment.apiUrl}/refresh-token`);
  });

  it('logout should call API before clearing local session', () => {
    const token = createToken(3600);
    localStorage.setItem('token', token);

    service.logout().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/logout`);
    expect(req.request.method).toBe('POST');
    expect(localStorage.getItem('token')).toBe(token);

    req.flush({});
    expect(localStorage.getItem('token')).toBeNull();
    expect(service.getCurrentUser()).toBeNull();
  });

  it('logoutLocal should clear token without calling API', () => {
    localStorage.setItem('token', createToken(3600));

    service.logoutLocal();

    expect(localStorage.getItem('token')).toBeNull();
    httpMock.expectNone(`${environment.apiUrl}/logout`);
  });
});
