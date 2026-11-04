import { Link } from 'react-router-dom'

export default function Brand({ inverse = false, home = '/' }) {
  return <Link to={home} className="brand-logo" aria-label="성북 안전공백지도 홈"><img src={inverse ? '/brand/logo-white.png' : '/brand/logo.png'} alt="성북 안전공백지도" /></Link>
}
