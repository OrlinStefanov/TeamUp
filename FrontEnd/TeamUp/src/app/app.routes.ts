import { Routes } from '@angular/router';
import { SignUp } from './pages/sign-up/sign-up';

export const routes: Routes = [
<<<<<<< Updated upstream
  { 
    path: '',
    component: SignUp
  }
=======
  { path: '', component: StartUp },
  { path: 'signup', component: SignUp },
  { path: 'login', component: LogIn },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuardGuardGuard] },
>>>>>>> Stashed changes
];
