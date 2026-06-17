import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { Auth } from '../auth/auth';

const publicAuthPaths = [
  '/login',
  '/register',
  '/refresh-token',
  '/forgot-password',
  '/reset-password',
  '/auth/register',
  '/auth/verify-email',
];

function shouldAttemptRefresh(url: string): boolean {
  return !publicAuthPaths.some(path => url.includes(path));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const token = auth.getToken();

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !shouldAttemptRefresh(req.url)) {
        return throwError(() => error);
      }

      return auth.refreshToken().pipe(
        switchMap(newToken => {
          const retryReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newToken}`,
            },
          });
          return next(retryReq);
        }),
        catchError(refreshError => {
          auth.logoutLocal();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
