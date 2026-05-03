declare namespace Express {
  export interface Request {
    userIp?: string;
    token?: { id: number } | null;
    role?: string;
    cfAccess?: {
      sub?: string;
      email?: string;
      type?: string;
      identityNonce?: string;
      aud?: string | string[];
      issuer?: string;
      expiresAt?: number;
      issuedAt?: number;
    };
    tId: string;
    ua: string;
    rateLimitChecked?: boolean;
  }

  export interface Response {
    success: {
      (msg: any): void;
      (msg: string, data: any): void;
    };
    fail: {
      (statusCode: number): void;
      (statusCode: number, msg: string): void;
      (statusCode: number, msg: string, data: any): void;
    };
  }
}
