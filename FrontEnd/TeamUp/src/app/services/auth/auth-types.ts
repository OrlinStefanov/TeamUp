export interface RegisterUser {
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    password : string;
    birthDate: Date;
    phoneNumber: string;
}

export interface LoginUser {
    emailOrUsername: string;
    password: string;
}

export interface User {
    id: string;
    username: string;
    email: string;
    exp: number;
}

export interface ResetUser {
    emailOrUsername: string;
    token : string;
    newPassword : string;
}

export interface UserProfile {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    birthDate: Date;
    phoneNumber: string;
}