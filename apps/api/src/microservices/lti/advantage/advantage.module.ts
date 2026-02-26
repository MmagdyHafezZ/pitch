import { Module } from '@nestjs/common';
import { DeepLinkingModule } from './deep-linking/deep-linking.module';
import { NrpsModule } from './nrps/nrps.module';
import { AgsModule } from './ags/ags.module';

/**
 * LTI Advantage bundle module.
 * Exports all three Advantage services: Deep Linking, NRPS, AGS.
 */
@Module({
  imports: [DeepLinkingModule, NrpsModule, AgsModule],
  exports: [DeepLinkingModule, NrpsModule, AgsModule],
})
export class AdvantageModule {}
