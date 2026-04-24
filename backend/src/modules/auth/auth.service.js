var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
let AuthService = (() => {
    let _classDecorators = [Injectable()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var AuthService = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            AuthService = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        prisma;
        jwtService;
        constructor(prisma, jwtService) {
            this.prisma = prisma;
            this.jwtService = jwtService;
        }
        async login(body) {
            if (!body) {
                throw new UnauthorizedException('Request body missing');
            }
            const { email, password } = body;
            // 1. Find user by email or phone (PRD v10 Unified Login)
            const user = await this.prisma.user.findFirst({
                where: {
                    OR: [{ email }, { phone: email }]
                },
            });
            if (!user) {
                throw new UnauthorizedException('Invalid email or password');
            }
            // 2. Compare password
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                throw new UnauthorizedException('Invalid email or password');
            }
            // 3. Generate 6-digit OTP (PRD §15.1)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL
            await this.prisma.loginOtp.create({
                data: {
                    contact: email,
                    otp,
                    expiresAt,
                },
            });
            // In a real scenario, integrate Resend.com here to send the OTP email
            console.log(`[DEV] OTP for ${email}: ${otp}`);
            return {
                success: true,
                message: 'OTP sent to email',
                contact: email,
            };
        }
        async verifyOtp(contact, otp) {
            const otpRecord = await this.prisma.loginOtp.findFirst({
                where: { contact, otp, expiresAt: { gt: new Date() } },
                orderBy: { createdAt: 'desc' },
            });
            if (!otpRecord) {
                throw new UnauthorizedException('Invalid or expired OTP');
            }
            const user = await this.prisma.user.findFirst({
                where: {
                    OR: [{ email: contact }, { phone: contact }]
                }
            });
            if (!user)
                throw new UnauthorizedException('User no longer exists');
            // PRD v10 Lifecycle Rule: Block if not active
            if (!user.isActive) {
                throw new UnauthorizedException('Account is not active or has been suspended');
            }
            // Cleanup used OTP
            await this.prisma.loginOtp.deleteMany({ where: { contact } });
            const payload = { userId: user.id, email: user.email, roles: user.roles };
            // PRD §7.1 — Access and Refresh Token Generation
            const accessToken = this.jwtService.sign(payload);
            const refreshToken = this.jwtService.sign({ userId: user.id }, { expiresIn: '90d' } // PRD §15.1
            );
            return {
                success: true,
                message: 'Login successful',
                data: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    user: { id: user.id, email: user.email, roles: user.roles },
                }
            };
        }
    };
    return AuthService = _classThis;
})();
export { AuthService };
