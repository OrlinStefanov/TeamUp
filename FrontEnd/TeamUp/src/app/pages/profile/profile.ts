import { Component } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-profile',
  imports: [ CommonModule , FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})

export class Profile {
  constructor(private auth: Auth) {}

  user_data: any = null;
  previewProfilePictureUrl: string = '';
  selectedProfileFile: File | null = null;
  isUploadingProfilePicture: boolean = false;
  mockUserData = {
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+359 88 123 4567',
    location: 'Sofia, Bulgaria',
    bio: 'Productive teammate focused on collaboration and delivery.'
  };

  ngOnInit() {
    this.auth.me().subscribe((res) => {
      this.user_data = res;
      this.previewProfilePictureUrl = this.user_data?.profilePictureUrl ?? '';
      console.log(this.user_data);
    });
  }

  get displayProfilePictureUrl(): string {
    return this.previewProfilePictureUrl || this.user_data?.profilePictureUrl || '';
  }

  get userInitial(): string {
    const userName = this.user_data?.userName ?? this.mockUserData.fullName;
    return userName?.charAt(0)?.toUpperCase() || '?';
  }

  triggerFilePicker(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedProfileFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.previewProfilePictureUrl = String(reader.result || '');
    };
    reader.readAsDataURL(file);

    this.uploadProfilePicture();
  }

  uploadProfilePicture(): void {
    if (!this.selectedProfileFile || this.isUploadingProfilePicture) {
      return;
    }

    this.isUploadingProfilePicture = true;
    this.auth.uploadProfilePic(this.selectedProfileFile).subscribe({
      next: (res: any) => {
        const uploadedUrl = res?.profilePictureUrl ?? res?.url ?? this.previewProfilePictureUrl;
        this.user_data = {
          ...(this.user_data || {}),
          profilePictureUrl: uploadedUrl
        };
        this.previewProfilePictureUrl = uploadedUrl;
        this.selectedProfileFile = null;
        this.isUploadingProfilePicture = false;
      },
      error: () => {
        this.isUploadingProfilePicture = false;
      }
    });
  }
}
