import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";
import { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: "email" });
  }

  async validate(
    email: string,
    password: string,
  ): Promise<Pick<AuthenticatedUser, "sub" | "email" | "role">> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException("Identifiants invalides");
    }
    return {
      sub: user.id,
      email: user.email,
      role: user.role as AuthenticatedUser["role"],
    };
  }
}
