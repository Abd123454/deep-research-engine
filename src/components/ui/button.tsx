import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] hover:bg-[#6b3410] dark:hover:bg-[#8b4513]",
        destructive:
          "bg-[#a33a3a] text-[#faf8f3] hover:bg-[#a33a3a] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#1c1a17] hover:bg-[#f4f1ea] dark:hover:bg-[#322e28] hover:text-[#2a2620] dark:hover:text-[#e8e3d8]",
        secondary:
          "bg-[#d9d4c7] dark:bg-[#322e28] text-[#2a2620] dark:text-[#e8e3d8] hover:bg-[#e0d9c8] dark:hover:bg-[#3d3830]",
        ghost:
          "hover:bg-[#2a2620]/5 dark:hover:bg-[#e8e3d8]/5 hover:text-[#2a2620] dark:hover:text-[#e8e3d8]",
        link: "text-[#8b4513] dark:text-[#b5673a] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
