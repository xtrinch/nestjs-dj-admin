declare global {
  namespace Express {
    interface User {
      id: string;
      role?: string;
      roles?: string[];
      email?: string;
      isSuperuser?: boolean;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
