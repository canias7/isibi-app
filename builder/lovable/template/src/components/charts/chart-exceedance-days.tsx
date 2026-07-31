import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ExceedanceDays } from "@/components/charts/lib/airquality"
let s = 29
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const daily = Array.from({ length: 365 }, (_, d) => {
  const winter = Math.cos((d / 365) * 2 * Math.PI) * 9
  const episode = (d > 58 && d < 66) || (d > 88 && d < 95) || (d > 292 && d < 299) ? 42 : 0
  return Math.max(4, 26 + winter + episode + Math.pow(rnd(), 2.6) * 34)
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily limit</CardTitle>
        <CardDescription>Exceedances counted against the annual allowance</CardDescription>
      </CardHeader>
      <CardContent>
        <ExceedanceDays daily={daily} limit={50} allowedExceedances={35} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The allowance was spent before autumn <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          PM₁₀, 50 µg/m³
        </div>
      </CardFooter>
    </Card>
  )
}
