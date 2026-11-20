import React from 'react';
import { SvgXml } from 'react-native-svg';
import { CODER_LOGO_XML } from './coderLogoXml';

/** Coder's typewriter, the same drawing as the web page's logo (still). */
export function Logo({ size = 40 }: { size?: number }) {
  return <SvgXml xml={CODER_LOGO_XML} width={size} height={size} accessibilityLabel="Coder" />;
}
