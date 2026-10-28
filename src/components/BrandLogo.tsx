import { getAssetUrl } from '../game/assetManifest'
/** Crops transparent padding in CSS only. The original logo pixels stay untouched. */
export default function BrandLogo() {
  return <span className="brand-logo">
    <img src={getAssetUrl('ui', 'logo') ?? undefined} alt="Sushi Kiri" />
  </span>
}
