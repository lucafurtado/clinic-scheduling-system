import type { Clinica } from '@prisma/client';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  permissoes: string[];
}

declare global {
  namespace Express {
    interface Request {
      clinica?: Clinica;
      usuarioAutenticado?: UsuarioAutenticado;
    }
  }
}

export {};
