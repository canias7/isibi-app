import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShadingLoss } from "@/components/charts/lib/solar"
const strings = [
  { name: "South, unshaded", modules: Array.from({ length: 12 }, () => ({ shaded: 0 })) },
  { name: "South, flue at the end", modules: Array.from({ length: 12 }, (_, i) => ({ shaded: i === 11 ? 0.35 : 0 })) },
  { name: "West, dormer", modules: Array.from({ length: 12 }, (_, i) => ({ shaded: i >= 8 ? 0.2 : 0 })) },
  { name: "West, tree line", modules: Array.from({ length: 12 }, (_, i) => ({ shaded: i < 4 ? 0.7 : i < 6 ? 0.25 : 0 })) },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shading</CardTitle>
        <CardDescription>Loss set by substrings, not by area</CardDescription>
      </CardHeader>
      <CardContent>
        <ShadingLoss strings={strings} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A flue pipe costs a roof <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three strings, 10:00
        </div>
      </CardFooter>
    </Card>
  )
}
