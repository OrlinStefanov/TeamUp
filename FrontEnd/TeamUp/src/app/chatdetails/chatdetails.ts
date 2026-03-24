import { Component } from '@angular/core';
import { ChatService } from '../services/chat-services/chat-service';
import { FormsModule } from '@angular/forms';
import { Auth } from '../services/auth/auth';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-chatdetails',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterOutlet
  ],
  templateUrl: './chatdetails.html',
  styleUrl: './chatdetails.css',
})
export class Chatdetails {
  channels$!: Observable<any[]>;

  workspaceId: string = '';
  selectedWorkspaceId: number = 0;

  constructor(
    private chat: ChatService,
    private auth: Auth,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.parent?.params.subscribe(params => {
      this.workspaceId = params['id'];

      this.auth.getWorkspaceInfo(this.workspaceId).subscribe({
        next: (workspace) => {
          this.selectedWorkspaceId = workspace.id;

          this.chat.loadChannels(this.selectedWorkspaceId.toString());

          this.channels$ = this.chat.channels$;
        }
      });
    });
  }

  createChannel() {
    this.auth.createChannel(this.selectedWorkspaceId).subscribe({
      next: (newChannel: any) => {
        this.chat.addChannel(newChannel);
      }
    });
  }
}