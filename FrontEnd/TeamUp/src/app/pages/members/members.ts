import { Component, HostListener, OnInit } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-members',
  imports: [CommonModule, FormsModule, RouterModule, RouterOutlet, RouterLink],
  templateUrl: './members.html',
  styleUrl: './members.css',
})

export class Members implements OnInit {
  constructor(private auth: Auth, private route: ActivatedRoute) {}

  members: any[] = [];
  invitations: any[] = [];
  searchTerm: string = '';
  selectedRole: string = 'all';
  currentUserId: string = '';
  currentUserRole: number = 0;
  openMenuMemberId: string | null = null;

  activeTab: string = 'members';

  ngOnInit() {
    this.currentUserId = this.auth.getUserId();

    this.route.parent?.paramMap.subscribe(params => {
      const id = params.get('id');

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

    member.role = role;
    this.openMenuMemberId = null;
  }

  removeMember(member: any, event?: Event): void {
    event?.stopPropagation();
    if (!this.canRemoveMember(member)) {
      return;
    }

    const memberId = this.getMemberId(member);
    this.members = this.members.filter((m) => this.getMemberId(m) !== memberId);
    this.openMenuMemberId = null;
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
}