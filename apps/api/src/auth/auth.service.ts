import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { Pool } from 'pg';

const RegisterSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Injectable()
export class AuthService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  constructor(private readonly jwt: JwtService) {}

  async register(payload: unknown) {
    const { email, fullName, password } = RegisterSchema.parse(payload);

    const exists = await this.pool.query('SELECT 1 FROM users WHERE email=$1', [email]);
    if (exists.rowCount) throw new BadRequestException('Email already used');

    const password_hash = await bcrypt.hash(password, 10);
    const res = await this.pool.query(
      'INSERT INTO users (email, full_name, password_hash) VALUES ($1,$2,$3) RETURNING id,email,full_name',
      [email, fullName, password_hash],
    );

    const user = res.rows[0];
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { user, token };
  }

  async login(payload: unknown) {
    const { email, password } = LoginSchema.parse(payload);

    const res = await this.pool.query(
      'SELECT id,email,full_name,password_hash FROM users WHERE email=$1',
      [email],
    );

    if (!res.rowCount) throw new UnauthorizedException('Invalid credentials');
    const user = res.rows[0];

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { user: { id: user.id, email: user.email, fullName: user.full_name }, token };
  }
}
