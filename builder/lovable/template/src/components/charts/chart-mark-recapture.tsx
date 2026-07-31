import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MarkRecapture } from "@/components/charts/lib/ecology"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mark and recapture</CardTitle>
        <CardDescription>Lincoln–Petersen with the Chapman correction</CardDescription>
      </CardHeader>
      <CardContent>
        <MarkRecapture marked={84} captured={96} recaptured={19} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The interval is wide because recaptures are few <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Great crested newt
        </div>
      </CardFooter>
    </Card>
  )
}
