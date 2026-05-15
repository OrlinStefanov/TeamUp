import { Component } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { error } from 'node:console';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-profile',
  imports: [ CommonModule , FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})

export class Profile {
  constructor(private auth: Auth, private router: Router) {}

  isDarkMode$!: Observable<boolean>;
  isEditMode: boolean = false;
  user_data: any = null;
  previewProfilePictureUrl: string = '';
  selectedProfileFile: File | null = null;
  isUploadingProfilePicture: boolean = false;

  currentPassword: string = '';
  newPassword: string = '';
  confirmNewPassword: string = '';
  passwordMessage: string = '';
  successfulPasswordChange: boolean = false;

  mockUserData = {
    fullName: 'John Doe',
    userName: 'john.doe',
    email: 'john.doe@example.com',
    phone: '+359 88 123 4567',
    birthDate: '1998-01-01'
  };
  editableUserData = {
    fullName: '',
    userName: '',
    email: '',
    phone: '',
    birthDate: ''
  };
  saveInfoMessage: string = '';

  ngOnInit() {
    this.isDarkMode$ = this.auth.darkMode$;

    this.auth.me().subscribe((res) => {
      this.user_data = res;
      this.previewProfilePictureUrl = this.user_data?.profilePictureUrl ?? '';
      this.populateEditableData();
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

  saveUserInfo(): void {
    // Local save for now (until profile update endpoint is available)
    const [firstName, ...rest] = this.editableUserData.fullName.trim().split(' ');
    const lastName = rest.join(' ');

    this.user_data = {
      ...(this.user_data || {}),
      firstName: firstName || '',
      lastName: lastName || '',
      userName: this.editableUserData.userName,
      email: this.editableUserData.email,
      phoneNumber: this.editableUserData.phone,
      birthDate: this.editableUserData.birthDate
    };

    this.auth.updateUserInfo(this.user_data).subscribe({
      next: (res) => {
        console.log(res);
      },
      error: () => {
      } 
    });

    this.saveInfoMessage = 'Profile info saved locally.';
  }

  private populateEditableData(): void {
    const firstName = this.user_data?.firstName ?? '';
    const lastName = this.user_data?.lastName ?? '';
    const fullNameFromApi = `${firstName} ${lastName}`.trim();

    this.editableUserData = {
      fullName: fullNameFromApi || this.mockUserData.fullName,
      userName: this.user_data?.userName || this.mockUserData.userName,
      email: this.user_data?.email || this.mockUserData.email,
      phone: this.user_data?.phoneNumber || this.mockUserData.phone,
      birthDate: this.user_data?.birthDate || this.mockUserData.birthDate
    };
  }

  handleEditClick() {
    if (this.isEditMode) {
      this.cancelEdit(); // като closeJoinWorkspace()
    } else {
      this.toggleEdit();
    }
  }

  cancelEdit() {
    this.isEditMode = false;
  }

  toggleEdit() {
    this.isEditMode = !this.isEditMode;
  }

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmNewPassword) {
      this.passwordMessage = 'All fields are required.';
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordMessage = 'New passwords do not match.';
      return;
    }

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
      },
      error: (err) => {
        console.log(err.error); // THIS is the important part
        this.passwordMessage = err.error;
        this.successfulPasswordChange = false;
      }
    });
  }
}
