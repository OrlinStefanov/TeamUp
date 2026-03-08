export interface RegisterUser {
    UserName: string;
    FirstName: string;
    LastName: string;
    Email: string;
    Password: string;
}

export interface LoginUser {
    EmailOrUsername: string;
    Password: string;
}

export interface User {
    id: string;
    username: string;
    email: string;
    exp: number;
}