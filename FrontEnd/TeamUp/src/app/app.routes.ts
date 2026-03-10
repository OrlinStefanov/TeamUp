import { Routes } from '@angular/router';
import { SignUp } from './pages/sign-up/sign-up';
import { LogIn } from './pages/log-in/log-in';
import { ForgotPassword } from './pages/forgot-password/forgot-password';

export const routes: Routes = [
  { path: '', component: SignUp },
  { path: 'login', component: LogIn },
  { path: 'forgot-password', component: ForgotPassword }
];
