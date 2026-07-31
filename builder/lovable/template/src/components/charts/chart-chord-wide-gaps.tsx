import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Chord, SERVICE_LABELS, SERVICE_MATRIX } from "./lib/chord"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chord</CardTitle>
        <CardDescription>More space between groups.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Chord labels={SERVICE_LABELS} matrix={SERVICE_MATRIX} gapDeg={8} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cut and wash flow both ways <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
