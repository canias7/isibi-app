import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BufferCapacity } from "@/components/charts/lib/chemlab"
const points = Array.from({ length: 61 }, (_, i) => {
  const added = i * 0.6
  const f = (added - 18) / 4.4
  return { added: Number(added.toFixed(1)), ph: Number((2.9 + 8.6 / (1 + Math.exp(-f))).toFixed(2)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where a buffer actually buffers</CardTitle>
        <CardDescription>pH as base is added</CardDescription>
      </CardHeader>
      <CardContent>
        <BufferCapacity pKa={4.76} points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One unit either side of the pKa <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Acetate
        </div>
      </CardFooter>
    </Card>
  )
}
