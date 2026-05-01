import { Component, HostListener, OnInit } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-members',
  imports: [CommonModule, FormsModule, RouterModule, RouterOutlet, RouterLink],
  templateUrl: './members.html',
  styleUrl: './members.css',
})

export class Members implements OnInit {
  constructor(private auth: Auth, private route: ActivatedRoute) {}
  isDarkMode$!: Observable<boolean>;

  members: any[] = [];
  invitations: any[] = [];

  workspacePublicId: string = '';
  searchTerm: string = '';
  selectedRole: string = 'all';
  currentUserId: string = '';
  currentUserRole: number = 0;
  openMenuMemberId: string | null = null;
  roleMenuOpen: boolean = false;
  addMemberQuery: string = '';
  addMemberSuggestions: any[] = [];
  addMemberIsLoading: boolean = false;
  private addMemberSearchTimeout: any;

  activeTab: string = 'members';

  ngOnInit() {
    this.isDarkMode$ = this.auth.darkMode$;
    this.currentUserId = this.auth.getUserId();

    this.route.parent?.paramMap.subscribe(params => {
      const id = params.get('id');
      this.workspacePublicId = id ?? '';

      console.log('Workspace ID from route: ', id);

      if (id) {
        const workspace_info = this.auth.getCachedWorkspaceById(id);
        console.log('Cached Workspace: ', workspace_info);

        if (workspace_info) {
          this.members = this.buildMembersWithOwner(workspace_info);
          this.invitations = workspace_info.invitations;
          this.setCurrentUserRole();
        }

        // If more details needed, fetch full workspace info
        if (!workspace_info) {
          this.auth.getWorkspaceInfo(id).subscribe(ws => {
            this.members = this.buildMembersWithOwner(ws);
            this.invitations = ws.invitations;
            this.setCurrentUserRole();

            console.log('Fetched Workspace: ', ws);
          });
        }
      }
    });
  }

  returnRoleName(role: number): string {
    switch (role) { 
      case 0: return 'Member';
      case 1: return 'Admin';
      case 2: return 'Owner';
      default: return 'Unknown';
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  get filteredMembers(): any[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.members.filter((member) => {
      const nameMatches = !term || member.userName?.toLowerCase().includes(term);
      const roleName = this.getRoleValue(member.role);
      const roleMatches = this.selectedRole === 'all' || roleName === this.selectedRole;

      return nameMatches && roleMatches;
    });
  }

  get filteredInvitations(): any[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.invitations.filter((invitation) => {
      const inviteName = String(
        invitation?.emailOrUsername ??
        invitation?.userName ??
        invitation?.email ??
        ''
      ).toLowerCase();

      return !term || inviteName.includes(term);
    });
  }

  getRoleValue(role: number): string {
    switch (role) {
      case 0:
        return 'member';
      case 1:
        return 'admin';
      case 2:
        return 'owner';
      default:
        return 'unknown';
    }
  }

  setCurrentUserRole(): void {
    const currentMember = this.members.find((member) => this.isCurrentUser(member));
    this.currentUserRole = currentMember?.role ?? 0;
  }

  isCurrentUser(member: any): boolean {
    const memberId = this.getMemberId(member);
    return !!memberId && memberId === this.currentUserId;
  }

  getMemberId(member: any): string {
    return String(member?.id ?? member?.userId ?? member?.publicId ?? '');
  }

  canManageMembers(): boolean {
    return this.currentUserRole === 1 || this.currentUserRole === 2;
  }

  canRemoveMember(member: any): boolean {
    if (!this.canManageMembers() || this.isCurrentUser(member)) {
      return false;
    }

    if (member.role === 2) {
      return false;
    }

    if (this.currentUserRole === 1 && member.role === 1) {
      return false;
    }

    return true;
  }

  canChangeRole(member: any): boolean {
    if (!this.canManageMembers() || this.isCurrentUser(member)) {
      return false;
    }

    if (member.role === 2) {
      return false;
    }

    if (this.currentUserRole === 1 && member.role === 1) {
      return false;
    }

    return true;
  }

  canOpenActionsMenu(member: any): boolean {
    return this.canChangeRole(member) || this.canRemoveMember(member);
  }

  toggleMemberMenu(member: any, event: Event): void {
    event.stopPropagation();
    const memberId = this.getMemberId(member);
    this.openMenuMemberId = this.openMenuMemberId === memberId ? null : memberId;
  }

  isMenuOpen(member: any): boolean {
    return this.openMenuMemberId === this.getMemberId(member);
  }

  changeRole(member: any, role: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.canAssignRole(member, role)) {
      return;
    }

    const userId = this.getMemberId(member);
    if (!this.workspacePublicId || !userId) {
      return;
    }

    const payload = {
      publicId: this.workspacePublicId,
      userId,
      role
    };

    this.auth.changeMemberRole(payload).subscribe({
      next: () => {
        member.role = role;
        this.setCurrentUserRole();
        this.openMenuMemberId = null;
        this.refreshWorkspaceInfo();
      },
      error: () => {
        this.openMenuMemberId = null;
      }
    });
  }

  removeMember(member: any, event?: Event): void {
    event?.stopPropagation();
    if (!this.canRemoveMember(member)) {
      return;
    }

    const memberId = this.getMemberId(member);
    if (!this.workspacePublicId || !memberId) {
      return;
    }

    this.auth.removeMemberFromWorkspace(this.workspacePublicId, memberId).subscribe({
      next: () => {
        this.members = this.members.filter((m) => this.getMemberId(m) !== memberId);
        this.openMenuMemberId = null;
        this.refreshWorkspaceInfo();
      },
      error: () => {
        this.openMenuMemberId = null;
      }
    });
  }

  respondToInvitation(invitation: any, action: 'accept' | 'reject', event?: Event): void {
    event?.stopPropagation();
    const invitationId = this.getInvitationId(invitation);
    if (!invitationId) {
      return;
    }

    this.auth.acceptInvitation(invitationId, action).subscribe({
      next: () => {
        this.refreshWorkspaceInfo();
      },
      error: () => {}
    });
  }

  canAssignRole(member: any, role: number): boolean {
    if (!this.canChangeRole(member)) {
      return false;
    }

    if (this.currentUserRole !== 2 && role === 2) {
      return false;
    }

    return member.role !== role;
  }

  @HostListener('document:click')
  closeMenus(): void {
    this.openMenuMemberId = null;
    this.roleMenuOpen = false;
  }

  openAddMemberModal(): void {
    this.addMemberQuery = '';
    this.addMemberSuggestions = [];
    this.addMemberIsLoading = false;

    const modalEl = document.getElementById('addMemberModal');
    if (!modalEl) return;
    const modal = new (window as any).bootstrap.Modal(modalEl);
    modal.show();
  }

  onAddMemberInputChange(value: string): void {
    this.addMemberQuery = value;

    if (this.addMemberSearchTimeout) {
      clearTimeout(this.addMemberSearchTimeout);
    }

    const query = value.trim();
    if (query.length < 2) {
      this.addMemberSuggestions = [];
      this.addMemberIsLoading = false;
      return;
    }

    this.addMemberIsLoading = true;
    this.addMemberSearchTimeout = setTimeout(() => {
      this.auth.searchUsers(query).subscribe({
        next: (res: any) => {
          const list = Array.isArray(res) ? res : (res?.items ?? []);

          this.addMemberSuggestions = list.filter((u: any) => !this.isUserInWorkspace(u));
          this.addMemberIsLoading = false;
        },
        error: () => {
          this.addMemberSuggestions = [];
          this.addMemberIsLoading = false;
        }
      });
    }, 300);
  }

  selectUserToAdd(user: any): void {
    if (this.isUserInWorkspace(user)) {
      return;
    }

    if (!this.workspacePublicId) {
      return;
    }

    const emailOrUsername = String(user?.emailOrUsername ?? user?.userName ?? '').trim();
    if (!emailOrUsername) {
      return;
    }

    this.addMemberIsLoading = true;
    const payload = {
      publicId: this.workspacePublicId,
      emailOrUsername,
      role: 0
    };

    this.auth.addMemberToWorkspace(payload).subscribe({
      next: () => {
        this.addMemberIsLoading = false;
        this.addMemberQuery = '';
        this.addMemberSuggestions = [];

        const modalEl = document.getElementById('addMemberModal');
        const modal = modalEl ? (window as any).bootstrap.Modal.getInstance(modalEl) : null;
        modal?.hide();

        this.refreshWorkspaceInfo();
      },
      error: () => {
        this.addMemberIsLoading = false;
      }
    });
  }

  private isUserInWorkspace(user: any): boolean {
    const userId = this.getMemberId(user);
    if (userId) {
      return this.members.some((m) => this.getMemberId(m) === userId);
    }

    const username = String(user?.userName ?? '').trim().toLowerCase();
    if (!username) return false;

    return this.members.some((m) => String(m?.userName ?? '').trim().toLowerCase() === username);
  }

  private getInvitationId(invitation: any): string {
    return String(invitation?.id ?? invitation?.invitationId ?? invitation?.publicId ?? '');
  }

  toggleRoleMenu(event: Event): void {
    event.stopPropagation();
    this.roleMenuOpen = !this.roleMenuOpen;
  }

  setRoleFilter(role: string, event?: Event): void {
    event?.stopPropagation();
    this.selectedRole = role;
    this.roleMenuOpen = false;
  }

  getRoleFilterLabel(): string {
    switch (this.selectedRole) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      case 'member':
        return 'Member';
      default:
        return 'All Roles';
    }
  }

  getUserInitial(userName: string): string {
    return (userName || '?').trim().charAt(0).toUpperCase();
  }

  private buildMembersWithOwner(workspace: any): any[] {
    const members = Array.isArray(workspace?.members) ? [...workspace.members] : [];
    const owner = workspace?.owner;
    if (!owner) return members;

    const ownerId = this.getMemberId(owner);
    const ownerExists = members.some((member) => this.getMemberId(member) === ownerId);

    if (!ownerExists) {
      members.push(owner);
    }

    return members;
  }

  private refreshWorkspaceInfo(): void {
    if (!this.workspacePublicId) return;

    this.auth.getWorkspaceInfo(this.workspacePublicId, true).subscribe({
      next: (ws) => {
        this.members = this.buildMembersWithOwner(ws);
        this.invitations = ws.invitations;
        this.setCurrentUserRole();
      },
      error: () => {}
    });
  }
}
