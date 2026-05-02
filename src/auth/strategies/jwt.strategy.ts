import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";
import { JwtPayload } from "../dto/auth.dto";
import { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { TokenBlacklistService } from "../token-blacklist.service";

interface SignedJwtPayload extends JwtPayload {
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private blacklist: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get("JWT_SECRET"),
    });
  }

  async validate(payload: SignedJwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.actif) {
      throw new UnauthorizedException("Token invalide ou expiré");
    }

    if (await this.blacklist.isRevoked(payload.sub, payload.iat)) {
      throw new UnauthorizedException("Token révoqué (déconnexion)");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as AuthenticatedUser["role"],
      organisationId: user.organisationId,
      equipeId: user.equipeId,
    };
  }
}
