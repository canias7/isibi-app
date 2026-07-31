import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DroughtMonitor } from "@/components/charts/lib/weather2"
const weeks = Array.from({ length: 52 }, (_, i) => {
  const p = i / 51
  const sev = Math.max(0, Math.sin((p * 0.9 + 0.02) * Math.PI))
  return {
    label: `w${i + 1}`,
    classes: [
      Math.min(0.34, sev * 0.34),
      Math.min(0.26, Math.max(0, sev - 0.18) * 0.42),
      Math.min(0.2, Math.max(0, sev - 0.38) * 0.44),
      Math.min(0.13, Math.max(0, sev - 0.58) * 0.38),
      Math.min(0.07, Math.max(0, sev - 0.76) * 0.32),
    ],
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drought coverage</CardTitle>
        <CardDescription>Share of the area in each class</CardDescription>
      </CardHeader>
      <CardContent>
        <DroughtMonitor weeks={weeks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Severity stacked from the bottom <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Rolling year
        </div>
      </CardFooter>
    </Card>
  )
}
