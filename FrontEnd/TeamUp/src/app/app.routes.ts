import { Routes } from '@angular/router';
import { SignUp } from './pages/sign-up/sign-up';
import { LogIn } from './pages/log-in/log-in';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { authGuardGuardGuard } from './services/AuthGuard/auth-guard-guard';
import { Dashboard } from './pages/dashboard/dashboard';
import { StartUp } from './pages/start-up/start-up';
export const routes: Routes = [
  { path: '', component: StartUp },
  { path: 'signup', component: SignUp },
  { path: 'login', component: LogIn },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'dashboard', component: Dashboard/*, canActivate: [authGuardGuardGuard]*/ },
  
];
