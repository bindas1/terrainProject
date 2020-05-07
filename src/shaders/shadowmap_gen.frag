precision mediump float;

varying vec3 v2f_position_view;

void main () {
	/* Todo 4.2.1
	Draw the shadow map.
	Compute the Euclidean distance from the light camera to the fragment.
	Store the distance into the red channel of the fragment's color.
	*/
	float depth = length(v2f_position_view);
	gl_FragColor.r = depth;
}
