import { type SVGProps, useId } from 'react'

import type { IconComponent } from '../../types'
const A33Light: IconComponent = (props: SVGProps<SVGSVGElement>) => {
  const iconId = useId()

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 64 64" {...props}>
      <defs>
        <linearGradient id={`${iconId}-a33light__a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${iconId}-a33light__a)`} />
      <path d="M14 46 L24 18 h4 L38 46 h-6 l-2-6 H22 l-2 6z M23.6 35 h4.8 L26 27.5z" fill="#fff" />
      <text
        x="49"
        y="40"
        fontFamily="Arial Black,Arial,sans-serif"
        fontWeight="900"
        fontSize="17"
        fill="#fff"
        textAnchor="middle">
        33
      </text>
    </svg>
  )
}
export { A33Light }
export default A33Light
