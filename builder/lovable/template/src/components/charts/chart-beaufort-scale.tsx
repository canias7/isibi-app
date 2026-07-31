import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BeaufortScale } from "@/components/charts/lib/weather2"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Beaufort force</CardTitle>
        <CardDescription>Defined by the sea, not the anemometer</CardDescription>
      </CardHeader>
      <CardContent>
        <BeaufortScale observed={24} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Still readable from a deck <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Observed 24 kt
        </div>
      </CardFooter>
    </Card>
  )
}
