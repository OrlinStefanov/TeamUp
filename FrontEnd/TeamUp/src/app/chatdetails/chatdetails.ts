import { Component } from '@angular/core';
import { ChatService } from '../services/chat-services/chat-service';
import { FormsModule } from '@angular/forms';
import { Auth } from '../services/auth/auth';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, ActivatedRoute, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ɵɵDir } from "@angular/cdk/scrolling";

@Component({
  selector: 'app-chatdetails',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterModule,
    RouterOutlet,
    ɵɵDir
],
  templateUrl: './chatdetails.html',
  styleUrl: './chatdetails.css',
})
export class Chatdetails {
  channels$!: Observable<any[]>;
  isDarkMode$!: Observable<boolean>;

  workspacePublicId: string = '';
  workspaceId : number = 0;

  selectedWorkspaceId: number = 0;

  newChannel = {
    name: '',
    description: '',
    isPrivate: false
  };

  unreadMap: any = {};
  private destroy$ = new Subject<void>();

  constructor(
    private chat: ChatService,
    private auth: Auth,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.isDarkMode$ = this.auth.darkMode$;

    this.route.parent?.params.subscribe(params => {
        const publicId = params['id'];
        if (!publicId) return;

        this.workspacePublicId = publicId;

        const cached = this.auth.getCachedWorkspaceById(publicId);

        if (cached) {
          this.workspaceId = cached.id;
          this.initChannels();
        } else {
          this.auth.getWorkspaceInfo(publicId).subscribe(ws => {
            this.workspaceId = ws.id;
            this.initChannels();
          });
        }

        this.chat.unread$
          .pipe(takeUntil(this.destroy$))
          .subscribe(map => {
            this.unreadMap = map;
          });
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initChannels() {
    this.chat.loadChannels(this.workspaceId.toString());
    this.channels$ = this.chat.channels$;
  }

  createChannel() {
    if (!this.workspaceId) {
      console.error('Workspace ID not loaded yet');
      return;
    }

    this.auth.createChannel(this.workspaceId, this.newChannel)
      .subscribe({
        next: () => {
          // reset form
          this.newChannel = {
            name: '',
            description: '',
            isPrivate: false
          };

          // refresh channels list (optional but recommended)
          this.chat.loadChannels(this.workspaceId.toString());

          // close modal
          const modalEl = document.getElementById('createChannelModal');
          const modal = (window as any).bootstrap.Modal.getInstance(modalEl);
          modal?.hide();
        },
        error: err => console.error(err)
      });
  }

  openCreateChannelModal() {
    const modal = new (window as any).bootstrap.Modal(
      document.getElementById('createChannelModal')
    );
    modal.show();
  }
}