import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CutFill } from "@/components/charts/lib/civil"
const stations = Array.from({ length: 48 }, (_, i) => {
  const ch = i * 50
  return {
    chainage: ch,
    existing: 42 + Math.sin(ch / 340) * 9 + Math.sin(ch / 91) * 2.6,
    proposed: 44 - (ch / 2400) * 5,
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cut and fill</CardTitle>
        <CardDescription>Existing ground against the proposed line</CardDescription>
      </CardHeader>
      <CardContent>
        <CutFill stations={stations} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Six hundred cubic metres must be imported <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Chainage 0 to 2400
        </div>
      </CardFooter>
    </Card>
  )
}
