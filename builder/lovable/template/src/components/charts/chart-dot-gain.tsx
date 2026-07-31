import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DotGain } from "@/components/charts/lib/printing"
const patches = [
  { fileTint: 0, measured: 0 }, { fileTint: 10, measured: 17.4 },
  { fileTint: 25, measured: 38.1 }, { fileTint: 40, measured: 56.2 },
  { fileTint: 50, measured: 66.9 }, { fileTint: 60, measured: 76.1 },
  { fileTint: 75, measured: 88.4 }, { fileTint: 90, measured: 96.2 },
  { fileTint: 100, measured: 100 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dot gain</CardTitle>
        <CardDescription>Measured gain against the aim curve</CardDescription>
      </CardHeader>
      <CardContent>
        <DotGain patches={patches} aimAt50={18} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Plotted as gain, because tint against tint is a straight line <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Aim 18% at 50
        </div>
      </CardFooter>
    </Card>
  )
}
