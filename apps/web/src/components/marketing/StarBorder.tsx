'use client'

import {
  createElement,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'
import styles from './StarBorder.module.css'

type StarBorderProps<T extends ElementType> = ComponentPropsWithoutRef<T> & {
  as?: T
  children: ReactNode
  className?: string
  innerClassName?: string
  color?: string
  speed?: CSSProperties['animationDuration']
  thickness?: number
}

const joinClasses = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ')

export function StarBorder<T extends ElementType = 'button'>({
  as,
  children,
  className,
  innerClassName,
  color = 'white',
  speed = '6s',
  thickness = 1,
  style,
  ...rest
}: StarBorderProps<T>) {
  const Component = (as ?? 'button') as ElementType

  return createElement(
    Component,
    {
      ...rest,
      className: joinClasses(styles.container, className),
      style: {
        padding: `${thickness}px 0`,
        ...(style as CSSProperties | undefined),
      },
    },
    <div
      key="gradient-bottom"
      className={styles.gradientBottom}
      style={{
        background: `radial-gradient(circle, ${color}, transparent 10%)`,
        animationDuration: speed,
      }}
    />,
    <div
      key="gradient-top"
      className={styles.gradientTop}
      style={{
        background: `radial-gradient(circle, ${color}, transparent 10%)`,
        animationDuration: speed,
      }}
    />,
    <div key="inner" className={joinClasses(styles.inner, innerClassName)}>
      {children}
    </div>
  )
}
