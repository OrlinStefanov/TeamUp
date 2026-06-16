import { Component, OnInit } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UpdateUser } from '../../services/auth/auth-types';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  constructor(private auth: Auth) {}

  isDarkMode$!: Observable<boolean>;
  isEditMode = false;
  user_data: any = null;
  previewProfilePictureUrl = '';
  selectedProfileFile: File | null = null;
  isUploadingProfilePicture = false;
  isSavingInfo = false;
  isChangingPassword = false;

  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  passwordMessage = '';
  successfulPasswordChange = false;

  editableUserData = {
    fullName: '',
    userName: '',
    email: '',
    phone: '',
    birthDate: ''
  };
  saveInfoMessage = '';
  saveInfoSuccess = false;

  ngOnInit() {
    this.isDarkMode$ = this.auth.darkMode$;

    this.auth.me().subscribe({
      next: (res) => {
        this.user_data = res;
        this.previewProfilePictureUrl = this.user_data?.profilePictureUrl ?? '';
        this.populateEditableData();
      },
      error: () => {
        this.saveInfoMessage = 'Could not load profile. Please try again.';
        this.saveInfoSuccess = false;
      }
    });
  }

  get displayProfilePictureUrl(): string {
    return this.previewProfilePictureUrl || this.user_data?.profilePictureUrl || '';
  }

  get displayName(): string {
    const firstName = this.user_data?.firstName ?? '';
    const lastName = this.user_data?.lastName ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || this.user_data?.userName || 'Your profile';
  }

  get userInitial(): string {
    const name = this.user_data?.userName ?? this.displayName;
    return name?.charAt(0)?.toUpperCase() || '?';
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
    input.value = '';
  }

  uploadProfilePicture(): void {
    if (!this.selectedProfileFile || this.isUploadingProfilePicture) {
      return;
    }

    this.isUploadingProfilePicture = true;
    this.auth.uploadProfilePic(this.selectedProfileFile).subscribe({
      next: (res: unknown) => {
        const uploadedUrl = this.extractUploadedImageUrl(res);
        if (uploadedUrl) {
          this.user_data = {
            ...(this.user_data || {}),
            profilePictureUrl: uploadedUrl
          };
          this.previewProfilePictureUrl = uploadedUrl;
        }
        this.selectedProfileFile = null;
        this.isUploadingProfilePicture = false;
      },
      error: () => {
        this.isUploadingProfilePicture = false;
        this.previewProfilePictureUrl = this.user_data?.profilePictureUrl ?? '';
      }
    });
  }

  saveUserInfo(): void {
    const [firstName, ...rest] = this.editableUserData.fullName.trim().split(' ');
    const lastName = rest.join(' ');

    const payload: UpdateUser = {
      firstName: firstName || '',
      lastName: lastName || '',
      userName: this.editableUserData.userName,
      email: this.editableUserData.email,
      phoneNumber: this.editableUserData.phone,
      birthDate: this.editableUserData.birthDate as unknown as Date
    };

    this.isSavingInfo = true;
    this.saveInfoMessage = '';

    this.auth.updateUserInfo(payload).subscribe({
      next: (res) => {
        this.user_data = res;
        this.populateEditableData();
        this.isEditMode = false;
        this.isSavingInfo = false;
        this.saveInfoMessage = 'Profile updated successfully.';
        this.saveInfoSuccess = true;
      },
      error: (err) => {
        this.isSavingInfo = false;
        this.saveInfoMessage = this.formatApiError(err.error) || 'Failed to update profile.';
        this.saveInfoSuccess = false;
      }
    });
  }

  private populateEditableData(): void {
    const firstName = this.user_data?.firstName ?? '';
    const lastName = this.user_data?.lastName ?? '';
    const fullNameFromApi = `${firstName} ${lastName}`.trim();

    this.editableUserData = {
      fullName: fullNameFromApi,
      userName: this.user_data?.userName ?? '',
      email: this.user_data?.email ?? '',
      phone: this.user_data?.phoneNumber ?? '',
      birthDate: this.normalizeBirthDate(this.user_data?.birthDate)
    };
  }

  handleEditClick() {
    if (this.isEditMode) {
      this.cancelEdit();
    } else {
      this.isEditMode = true;
      this.saveInfoMessage = '';
    }
  }

  cancelEdit() {
    this.populateEditableData();
    this.isEditMode = false;
    this.saveInfoMessage = '';
  }

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmNewPassword) {
      this.passwordMessage = 'All fields are required.';
      this.successfulPasswordChange = false;
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordMessage = 'New passwords do not match.';
      this.successfulPasswordChange = false;
      return;
    }

    this.isChangingPassword = true;
    this.passwordMessage = '';

    this.auth.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.passwordMessage = 'Password updated successfully.';
        this.successfulPasswordChange = true;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmNewPassword = '';
        this.isChangingPassword = false;
      },
      error: (err) => {
        this.passwordMessage = this.formatApiError(err.error) || 'Failed to update password.';
        this.successfulPasswordChange = false;
        this.isChangingPassword = false;
      }
    });
  }

  private extractUploadedImageUrl(res: unknown): string {
    if (typeof res === 'string') {
      return res.replace(/^Image uploaded\s*/i, '').trim();
    }

    if (res && typeof res === 'object') {
      const data = res as { profilePictureUrl?: string; url?: string };
      return data.profilePictureUrl ?? data.url ?? '';
    }

    return '';
  }

  private normalizeBirthDate(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') {
      return value.length >= 10 ? value.slice(0, 10) : value;
    }
    return '';
  }

  private formatApiError(error: unknown): string {
    if (Array.isArray(error)) {
      return error
        .map((item) => (typeof item === 'string' ? item : item?.description ?? ''))
        .filter(Boolean)
        .join(' ');
    }

    if (typeof error === 'string') {
      return error;
    }

    return '';
  }
}
