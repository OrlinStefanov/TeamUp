import { Routes } from '@angular/router';
import { SignUp } from './pages/sign-up/sign-up';
import { LogIn } from './pages/log-in/log-in';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { authGuardGuardGuard } from './services/AuthGuard/auth-guard-guard';
import { Dashboard } from './pages/dashboard/dashboard';
import { StartUp } from './pages/start-up/start-up';
import { Layout } from './layout/layout';
import { Taskdetails } from './taskdetails/taskdetails';
import { WorkspaceDetail } from './workspace-detail/workspace-detail';
import { Chatdetails } from './chatdetails/chatdetails';
export const routes: Routes = [
  { path: '', component: StartUp },
  { path: 'signup', component: SignUp },
  { path: 'login', component: LogIn },
  { path: 'forgot-password', component: ForgotPassword },
  {
    path: '',
    component: Layout,
    canActivate: [authGuardGuardGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },

      {
        path: 'workspace/:id',
        component: WorkspaceDetail,
        children: [
          { path: '', redirectTo: 'tasks', pathMatch: 'full' },
          { path: 'tasks', component: Taskdetails },
          { path: 'chat', component: Chatdetails },
        //  { path: 'leaderboard', component: Leaderboard }
        ]
      }
    ]
  }
];
