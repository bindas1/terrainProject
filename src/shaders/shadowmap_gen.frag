precision mediump float;

varying vec3 v2f_position_view; //position in light view

void main () {
	/* Todo 4.2.1
	Draw the shadow map.
	Compute the Euclidean distance from the light camera to the fragment.
	Store the distance into the red channel of the fragment's color.
	*/
	float depth = length(v2f_position_view); //since light is at 000, then computing the length of position = dist posn -> light
	gl_FragColor.r = depth;
}
