import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContrastLadder } from "@/components/charts/lib/design"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Readable ink levels</CardTitle>
        <CardDescription>WCAG ratio at each strength</CardDescription>
      </CardHeader>
      <CardContent>
        <ContrastLadder steps={[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Computed from luminance, not eyeballed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          On white
        </div>
      </CardFooter>
    </Card>
  )
}
