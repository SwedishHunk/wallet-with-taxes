export declare class SignupDto {
    email: string;
    password: string;
    studioName?: string;
}
export declare class LoginDto {
    email: string;
    password: string;
    studioId?: string;
}
export declare class LinkWalletDto {
    walletAddress: string;
    currentPassword: string;
    signature: string;
}
