import type { CompoundIcon, CompoundIconProps } from '../../types'
import { A33Avatar } from './avatar'
import { A33Light } from './light'

const A33 = ({ variant, className, ...props }: CompoundIconProps) => {
  if (variant === 'light') return <A33Light {...props} className={className} />
  return <A33Light {...props} className={className} />
}

export const A33Icon: CompoundIcon = /*#__PURE__*/ Object.assign(A33, {
  Avatar: A33Avatar,
  colorPrimary: '#F59E0B'
})

export default A33Icon
