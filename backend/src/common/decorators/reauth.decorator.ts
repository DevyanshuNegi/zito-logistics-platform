import { SetMetadata } from '@nestjs/common';

export const REAUTH_KEY = 'reauth_required';
export const Reauth = () => SetMetadata(REAUTH_KEY, true);
