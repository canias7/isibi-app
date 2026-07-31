import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { XHeightCompare } from "@/components/charts/lib/typography"
const families = [
  { name: "Georgia-like serif", stack: "Georgia, 'Times New Roman', serif", xHeight: 0.484, capHeight: 0.692, ascender: 0.756 },
  { name: "System sans", stack: "system-ui, sans-serif", xHeight: 0.517, capHeight: 0.7, ascender: 0.75 },
  { name: "Times-like", stack: "'Times New Roman', Times, serif", xHeight: 0.448, capHeight: 0.662, ascender: 0.683 },
  { name: "Monospace", stack: "ui-monospace, 'SF Mono', Menlo, monospace", xHeight: 0.53, capHeight: 0.7, ascender: 0.75 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>x-height</CardTitle>
        <CardDescription>The same point size in four families</CardDescription>
      </CardHeader>
      <CardContent>
        <XHeightCompare families={families} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Matching point size never matches optically <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          40px throughout
        </div>
      </CardFooter>
    </Card>
  )
}
