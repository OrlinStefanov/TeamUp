import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Auth } from '../../services/auth/auth';

type DirectMessage = {
  id: number;
  text: string;
  time: string;
  mine: boolean;
};

type DirectChat = {
  id: number;
  name: string;
  handle: string;
  preview: string;
  time: string;
  initials: string;
  status: 'online' | 'away' | 'offline';
  accent: string;
  messages: DirectMessage[];
};

@Component({
  selector: 'app-personal-dms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personal-dms.html',
  styleUrl: './personal-dms.css',
})
export class PersonalDms {
  @ViewChild('personSearchInput') personSearchInput?: ElementRef<HTMLInputElement>;

  isDarkMode$: Observable<boolean>;
  filterText = '';
  searchText = '';
  messageText = '';
  isNewMessageOpen = false;
  isMobileChatOpen = false;
  selectedChatId = 1;

  readonly chats: DirectChat[] = [
    {
      id: 1,
      name: 'Alice Chen',
      handle: '@alice_dev',
      preview: 'merging now ✨',
      time: '18:24',
      initials: 'AC',
      status: 'online',
      accent: '#2dd4bf',
      messages: [
        { id: 1, text: 'hey, did you push the auth fix?', time: '10:21', mine: false },
        { id: 2, text: 'yep, on the feature branch', time: '10:23', mine: true },
        { id: 3, text: 'merging now ✨', time: '18:24', mine: false },
      ],
    },
    {
      id: 2,
      name: 'Bob Rust',
      handle: '@bob.rust',
      preview: 'down. ramen?',
      time: '12:02',
      initials: 'BR',
      status: 'away',
      accent: '#a78bfa',
      messages: [
        { id: 1, text: 'small bug hunt after standup?', time: '11:56', mine: false },
        { id: 2, text: 'down. ramen?', time: '12:02', mine: false },
      ],
    },
    {
      id: 3,
      name: 'Carol Codes',
      handle: '@carol_codes',
      preview: 'review when you can 🙏',
      time: 'Yesterday',
      initials: 'CC',
      status: 'offline',
      accent: '#f472b6',
      messages: [
        { id: 1, text: 'left comments on the profile page', time: 'Yesterday', mine: false },
        { id: 2, text: 'review when you can 🙏', time: 'Yesterday', mine: false },
      ],
    },
  ];

  constructor(private auth: Auth) {
    this.isDarkMode$ = this.auth.darkMode$;
  }

  get filteredChats() {
    const query = this.filterText.trim().toLowerCase();

    if (!query) return this.chats;

    return this.chats.filter((chat) =>
      [chat.name, chat.handle, chat.preview].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }

  get selectedChat() {
    return this.chats.find((chat) => chat.id === this.selectedChatId) ?? this.chats[0];
  }

  openNewMessage() {
    this.isNewMessageOpen = true;
    this.searchText = '';

    setTimeout(() => this.personSearchInput?.nativeElement.focus(), 0);
  }

  closeNewMessage() {
    this.isNewMessageOpen = false;
    this.searchText = '';
  }

  selectChat(chatId: number) {
    this.selectedChatId = chatId;
    this.isMobileChatOpen = true;
  }

  closeMobileChat() {
    this.isMobileChatOpen = false;
  }

  sendMessage() {
    const text = this.messageText.trim();
    if (!text) return;

    this.selectedChat.messages.push({
      id: Date.now(),
      text,
      time: 'now',
      mine: true,
    });

    this.messageText = '';
  }
}
