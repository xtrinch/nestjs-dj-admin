declare global {
  namespace Express {
    interface User {
      id: string;
      permissions?: string[];
      email?: string;
      isSuperuser?: boolean;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
