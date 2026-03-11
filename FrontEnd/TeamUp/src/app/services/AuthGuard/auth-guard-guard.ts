import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Auth } from '../auth/auth';
import { Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';

export const authGuardGuardGuard: CanActivateFn = (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  return authService.me().pipe(
    map(() => true),  
    catchError(() => {
      router.navigate(['/log-in']);
      return of(false);
    })
  );
};
