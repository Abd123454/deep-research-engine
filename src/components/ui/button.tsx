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
          "bg-[#c96442] dark:bg-[#d97757] text-[#faf9f5] hover:bg-[#b5563a] dark:hover:bg-[#c6613f]",
        destructive:
          "bg-[#c44848] text-[#faf9f5] hover:bg-[#b53333] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-[#e8e6dc] dark:border-[#3d3a35] bg-[#faf9f5] dark:bg-[#1a1a18] hover:bg-[#f0eee6] dark:hover:bg-[#393937] hover:text-[#141413] dark:hover:text-[#faf9f5]",
        secondary:
          "bg-[#e8e6dc] dark:bg-[#393937] text-[#141413] dark:text-[#faf9f5] hover:bg-[#e3dacc] dark:hover:bg-[#4a4845]",
        ghost:
          "hover:bg-[#141413]/5 dark:hover:bg-[#faf9f5]/5 hover:text-[#141413] dark:hover:text-[#faf9f5]",
        link: "text-[#c96442] underline-offset-4 hover:underline",
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
