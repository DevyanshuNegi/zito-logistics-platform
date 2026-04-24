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
import { Injectable, Logger } from '@nestjs/common';
let ComplianceService = (() => {
    let _classDecorators = [Injectable()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ComplianceService = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            ComplianceService = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        prisma;
        logger = new Logger(ComplianceService.name);
        constructor(prisma) {
            this.prisma = prisma;
        }
        /**
         * Checks a specific driver's documents for expiry.
         * PRD §14, §18.1
         */
        async checkDriverExpiry(userId) {
            try {
                const driver = await this.prisma.driver.findUnique({ where: { userId } });
                if (!driver)
                    return null;
                const comp = await this.prisma.driverCompliance.findUnique({ where: { driverId: driver.id } });
                if (!comp)
                    return null;
                const now = new Date();
                const expiredFields = [];
                if (comp.licenseExpiry && new Date(comp.licenseExpiry) < now)
                    expiredFields.push('licenseExpiry');
                if (comp.policeClearanceExpiry && new Date(comp.policeClearanceExpiry) < now)
                    expiredFields.push('policeClearanceExpiry');
                if (comp.medicalExpiry && new Date(comp.medicalExpiry) < now)
                    expiredFields.push('medicalExpiry');
                if (expiredFields.length > 0) {
                    const comment = `Document expired: ${expiredFields.join(', ')}`;
                    await this.prisma.$transaction([
                        this.prisma.driver.update({
                            where: { id: driver.id },
                            data: { canReceiveAssignments: false, isAvailable: false }
                        }),
                        this.prisma.driverCompliance.update({
                            where: { driverId: driver.id },
                            data: {
                                complianceStatus: 'resubmission_required',
                                resubmissionComment: comment,
                            }
                        }),
                        this.prisma.user.update({
                            where: { id: userId },
                            data: { complianceStatus: 'resubmission_required' }
                        }),
                    ]);
                    return 'resubmission_required';
                }
            }
            catch (err) { // Type assertion for err
                this.logger.error(`checkDriverExpiry error for user ${userId}: ${err.message}`);
            }
            return null;
        }
        /**
         * Scans all currently 'approved' drivers and flags those with expired documents.
         * PRD §5.4
         */
        async runSystemWideExpiryCheck() {
            const users = await this.prisma.user.findMany({
                where: {
                    role: 'driver',
                    complianceStatus: 'approved',
                    isActive: true,
                    deletedAt: null
                },
                select: { id: true }
            });
            let flaggedCount = 0;
            for (const u of users) {
                const wasUpdated = await this.checkDriverExpiry(u.id);
                if (wasUpdated)
                    flaggedCount++;
            }
            return { totalChecked: users.length, flagged: flaggedCount };
        }
    };
    return ComplianceService = _classThis;
})();
export { ComplianceService };
