import { Component , OnInit} from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-leaderboard',
  imports: [ CommonModule],
  standalone: true,
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.css',
})

export class Leaderboard implements OnInit {
  constructor(private auth: Auth, private route : ActivatedRoute) {}

  leaderboardData: any = null;
  isDarkMode$: any;

  ngOnInit() {
    this.isDarkMode$ = this.auth.darkMode$;

    this.route.parent?.paramMap.subscribe(params => {
      const workspaceId = params.get('id');

      if (workspaceId) {
        console.log('Fetching leaderboard for workspace ID:', workspaceId);

        this.auth.getLeaderboard(workspaceId).subscribe((data: any) => {
          this.leaderboardData = data;
          console.log('Leaderboard data:', this.leaderboardData);
        });
      }
    });
  }
}
